//https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/deployment-bundle/bundle.ts
const fs = require("fs");
const path = require("path");
const { NodeGlobalsPolyfillPlugin } = require("@esbuild-plugins/node-globals-polyfill");
const { NodeModulesPolyfillPlugin } = require("@esbuild-plugins/node-modules-polyfill");
const esbuild = require("esbuild");
const { pathToFileURL } = require("url");

var nodejsCompatPlugin = /* @__PURE__ */ silenceWarnings => ({
  name: "nodejs_compat imports plugin",
  setup(pluginBuild) {
    const seen = /* @__PURE__ */ new Set();
    const warnedPackaged = /* @__PURE__ */ new Map();
    pluginBuild.onStart(() => {
      seen.clear();
      warnedPackaged.clear();
    });
    pluginBuild.onResolve({ filter: /node:.*/ }, async ({ path: path67, kind, resolveDir, ...opts }) => {
      const specifier = `${path67}:${kind}:${resolveDir}:${opts.importer}`;
      if (seen.has(specifier)) {
        return;
      }
      seen.add(specifier);
      const result = await pluginBuild.resolve(path67, {
        kind,
        resolveDir,
        importer: opts.importer,
      });
      if (result.errors.length > 0) {
        let pathWarnedPackaged = warnedPackaged.get(path67);
        if (pathWarnedPackaged === void 0) {
          warnedPackaged.set(path67, (pathWarnedPackaged = []));
        }
        pathWarnedPackaged.push(opts.importer);
        return { external: true };
      }
      return result;
    });
    pluginBuild.onEnd(() => {
      if (!silenceWarnings) {
        warnedPackaged.forEach((importers, path67) => {
          console.warn(
            `The package "${path67}" wasn't found on the file system but is built into node.
Your Worker may throw errors at runtime unless you enable the "nodejs_compat" compatibility flag. Refer to https://developers.cloudflare.com/workers/runtime-apis/nodejs/ for more details. Imported from:
${importers.map(i => ` - ${path.relative(pluginBuild.initialOptions.absWorkingDir ?? "/", i)}`).join("\n")}`,
          );
        });
      }
    });
  },
});

var cloudflareInternalPlugin = {
  name: "Cloudflare internal imports plugin",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^cloudflare:.*/ }, () => {
      return { external: true };
    });
  },
};

// 定义正则预编译插件
const cfhostRegexPrecompilePlugin = {
  name: "precompile-cfhost-regex",
  setup(pluginBuild) {
    // 拦截对 cfhostpat.js 的加载
    pluginBuild.onLoad({ filter: /cfhostpat\.js$/ }, async args => {
      // 1. 在构建时找到并读取真实的 JSON 文件
      // const jsonPath = path.join(path.dirname(args.path), "cfhostpat.json");
      // const jsonContent = await fs.promises.readFile(jsonPath, "utf8");
      // const cfhostpat = JSON.parse(jsonContent);
      // const cfhostpat = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      // 2. 获取纯文件的绝对路径，在 CommonJS 中动态 import ESM 模块
      const cfhostpatPath = path.join(path.dirname(args.path), "./cfhostpat.js");
      const { generateRegexString } = await import(pathToFileURL(cfhostpatPath).href);
      // 3. 执行逻辑并注入拼装好的 JS 代码
      // 使用 JSON.stringify 安全包裹字符串，防止转义字符出错
      const regexStr = generateRegexString();
      const injectedCode = `export default new RegExp(${JSON.stringify(regexStr)});`;

      return {
        contents: injectedCode,
        loader: "js",
      };
    });
  },
};

var htmlObfuscatorPlugin = {
  name: "html-obfuscator",
  setup(pluginBuild) {
    // 拦截所有 .html 文件的导入
    pluginBuild.onLoad({ filter: /\.html$/ }, async args => {
      // 读取原始明文 HTML
      const htmlContent = await fs.promises.readFile(args.path, "utf8");
      const buffer = Buffer.from(htmlContent);
      const key = 0x55; // 混淆密钥
      // 对每个字节进行异或操作
      const xorData = buffer.map(b => b ^ key);
      const hexString = xorData.toString("hex"); // 转成 16 进制字符串
      // 返回一段 JS 代码，默认导出一个 Base64 字符串
      return {
        contents: `export default "${hexString}";`,
        loader: "js",
      };
    });
  },
};

var args = process.argv.slice(2);
const opt = {
  entry: "src/_worker.js",
  workingDir: ".",
  outdir: "dist",
  nodeCompat: false,
};
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--entry":
      opt.entry = args[++i];
      break;
    case "--out-dir":
      opt.entry = args[++i];
      break;
    case "--working-dir":
      opt.workingDir = args[++i];
      break;
    case "--node-compat":
      opt.nodeCompat = true;
      break;
  }
}

const buildOptions = {
  bundle: true,
  entryPoints: [path.resolve(__dirname, opt.entry)],
  absWorkingDir: path.resolve(__dirname, opt.workingDir),
  outdir: opt.outdir,
  external: ["__STATIC_CONTENT_MANIFEST"],
  format: "esm",
  target: "es2022",
  // sourcemap: true,
  sourceRoot: opt.outdir,
  minify: true,
  metafile: true,
  conditions: ["workerd", "worker", "browser"],
  define: {
    "navigator.userAgent": '"Cloudflare-Workers"',
    "process.env.NODE_ENV": '"undefined"',
    global: "globalThis",
  },
  loader: { ".js": "jsx", ".mjs": "jsx", ".cjs": "jsx" },
  plugins: [
    ...(opt.nodeCompat ? [NodeGlobalsPolyfillPlugin({ buffer: true }), NodeModulesPolyfillPlugin(), nodejsCompatPlugin(false)] : []),
    cloudflareInternalPlugin,
    cfhostRegexPrecompilePlugin,
    htmlObfuscatorPlugin,
  ],
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  logLevel: "silent",
};

esbuild.build(buildOptions).then(console.log);
