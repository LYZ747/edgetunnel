import cfhostpat from "./cfhostpat.json" assert { type: "json" };

const cfdomain = "cloudflare(access|client|insights|previews|stream|storage|workers|-ipfs|-dns)?.(com|tv|dev)|(workers|pages).dev|one.one.one.one";
const otherdomain =
  "(accounts|assets|auth|console|data|docs|status).x.ai|(api|cdn|geo).transtore.app|ninetailed.co|(090cdn|bbdmfetch|^((cdn|www).)?buymeacoffee|(dsum(-sec)?|htlb|ssum(-sec)?).casalemedia|cff(jpg|pic|png)|(api|as|exceptions|wallet).coinbase|(cr(l|t)|ocsp).comodoca4?|compute-pipe|(capi|cds?).connatix|(dcmfe|gsstm|www).datacamp|^((experimentation|login-wall|static|www).)?deepl|(edge-hls|img|mmp).doppiocdn|(pub|vpaid|vtrk).doubleverify|(cdn\\d|data-api).downdetector|(ka\\-.|kit|site-assets|use).fontawesome|^((evtgw|g-static|gw|livecount|panel|www).)?ganjingworld|(app|documenter|elements|identity|identity-assets).getpostman|(assets|auth|cdn|ssff).grok|grokusercontent|^((assets|public-files).)?gumroad|hsforms|(\\d|c).html-load|(api|app|\\-eu1|\\-na2).hubspot|i-scmp|imgpog|imtintl|(api|backend|stcdn).leadconnectorhq|(image|m|jp|www).made-in-china|^((cdn-client|glyph|miro).)?medium|oaiusercontent|^((api|cdn).)?onesignal|privacy.*.onetrust|(api|auth0?|chat|help|platform|sentinel|videos).openai|(ads|oa|op-mobile).opera|(de|es|ext|zh).stripchat|strpst|tinypass|^((analytics|api|api-stream|developer|fonts|help|mobile|probe|syndication|www).)?twitter|^((blog|www).)?udemy|^((about|business|capsdeveloper|grok|help|support|transparency).)?x).com|^((static|tools).)?ietf.org|(service|sock|static|voice).cohere.so";

export function remove(data, domains) {
  let pat,
    ret = data;
  domains.forEach(d => {
    const pre = d.slice(0, d.lastIndexOf("."));
    const suf = d.slice(d.lastIndexOf("."));
    pat = RegExp(`(,?\n?\\s*)((?:'|")?${suf}(?:'|")?: ?)(?:'|")(.*)(?:'|"),?`);
    ret = ret.replace(pat, (l, g1, g2, g3, g4) => {
      const v = g3
        .split("|")
        .filter(p => p != pre)
        .join("|");
      return v ? g1 + g2 + `"${v}",` : g1;
    });
  });
  return ret.replace(/\n\s\n/g, "\n");
}

export function generateRegexString(data = cfhostpat) {
  return Object.entries(data).reduce(
    (r, [k, s]) => {
      r += `|(${s}).${k}`;
      return r;
    },
    cfdomain + "|" + otherdomain,
  );
}

const cfhostRE = new RegExp(generateRegexString());
export default cfhostRE;

// if (typeof process != "undefined") {
//   (function () {
//     if (!process.argv[1] || !process.argv[1].includes("cfhostpat")) return;
//     const argv = process.argv.slice(2);
//     const arg = argv.shift();
//     if (arg) {
//       try {
//         let r;
//         const f = eval(arg);
//         if (typeof f == "function") r = f(...argv);
//         else if (typeof f != undefined) r = f.toString();
//         r && console.log(r);
//       } catch (e) {
//         console.error("no function:", arg);
//       }
//     }
//   })();
// }
