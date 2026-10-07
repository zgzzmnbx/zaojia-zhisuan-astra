// Bind the reused preview to Astra; never read or write Gongwen preferences.
export const appTheme={
 getSnapshot:(): 'light'|'dark'=>document.documentElement.dataset.astraScheme==='dark'?'dark':'light',
 subscribe:(listener:()=>void)=>{const observer=new MutationObserver(listener);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-scheme']});return()=>observer.disconnect();},
};
