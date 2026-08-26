const PREFIX="wydev:";
export const loadState=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(PREFIX+key)) ?? fallback}catch{return fallback}};
export const saveState=(key,value)=>localStorage.setItem(PREFIX+key,JSON.stringify(value));