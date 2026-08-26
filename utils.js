export const ext=p=>p.split(".").pop()?.toLowerCase()||"";
export const languageFor=p=>({js:"javascript",jsx:"javascript",ts:"javascript",tsx:"javascript",json:"json",md:"markdown",py:"python",css:"css",html:"html"}[ext(p)]||"text");
export const copy=async text=>navigator.clipboard?.writeText(text);