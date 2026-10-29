// The band's email signature: plain lines with **bold** and [text](url) links, rendered to html and text
export const LOGO_CID = "cid:logo@floodlines";

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SAFE = /^(https?|mailto|tel):/i;
const TOKEN = /\*\*(.+?)\*\*|\[([^\]]*)\]\(([^)\s]*)\)/g;

function renderLine(line) {
  let html = "", text = "", at = 0;
  for (const m of line.matchAll(TOKEN)) {
    html += esc(line.slice(at, m.index));
    text += line.slice(at, m.index);
    at = m.index + m[0].length;
    if (m[1] !== undefined) {
      html += `<b>${esc(m[1])}</b>`;
      text += m[1];
    } else if (SAFE.test(m[3])) {
      html += `<a href="${esc(m[3])}">${esc(m[2])}</a>`;
      text += /^https?:/i.test(m[3]) ? `${m[2]}: ${m[3]}` : m[2];
    } else {
      html += esc(m[0]);
      text += m[0];
    }
  }
  return { html: html + esc(line.slice(at)) + "<br>", text: text + line.slice(at) };
}

export function renderSignature(source, { logoSrc } = {}) {
  let html = "";
  const text = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === "{logo}") {
      if (logoSrc) html += `<img src="${esc(logoSrc)}" alt="FloodLines" style="max-width:240px"><br>`;
      continue;
    }
    const r = renderLine(line);
    html += r.html;
    text.push(r.text);
  }
  return { html, text: text.join("\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim() };
}

// What the Templates screen saves to the shared settings; an empty signature is null
export function signatureSetting(source) {
  return source.trim() ? { source, ...renderSignature(source, { logoSrc: LOGO_CID }) } : null;
}
