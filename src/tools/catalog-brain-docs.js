import {readTool,field} from './api-tool.js';
import {TOOLS as EXISTING} from './catalog-research.js';
const str=field;
export const TOOLS=[
 {...EXISTING.find(t=>t.name==='read_document'),name:'doc_to_markdown',description:'Convert a public document using the existing guarded Cloudflare toMarkdown reader.',defer_loading:true,input_examples:[{url:'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'}]},
 readTool({name:'doc_ocr',group:'research',description:'Read text from an image or short PDF through OCR.space. Requires its free key and verified allowance.',properties:{url:str('Public HTTPS image or PDF URL')},required:['url'],example:{url:'https://example.com/document.png'},key:'OCR_SPACE_API_KEY',enable:'OCR_SPACE_ENABLED',request:(env,input)=>({url:'https://api.ocr.space/parse/image',target:input.url,method:'POST',headers:{apikey:env.OCR_SPACE_API_KEY,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({url:input.url,OCREngine:'2'}).toString()}),select:value=>{if(value.IsErroredOnProcessing)throw Error('OCR failed');return value.ParsedResults?.map(p=>p.ParsedText);}})
];
