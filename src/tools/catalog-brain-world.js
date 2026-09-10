import {readTool,field} from './api-tool.js';
const query=i=>encodeURIComponent(String(i.query).slice(0,150));
export const TOOLS=[
 readTool({name:'world_recalls',group:'world',description:'Search FDA food recall notices. Reports official notices, not personal medical advice.',properties:{query:field('Food or company name')},required:['query'],example:{query:'milk'},request:(_,i)=>({url:`https://api.fda.gov/food/enforcement.json?search=${query(i)}&limit=5&sort=report_date:desc`}),select:v=>v.results}),
 readTool({name:'world_drug_lookup',group:'world',description:'Read official FDA medicine labeling by drug name. Labels can be long; consult a pharmacist for personal decisions.',properties:{query:field('Drug name')},required:['query'],example:{query:'ibuprofen'},request:(_,i)=>({url:`https://api.fda.gov/drug/label.json?search=openfda.generic_name:${query(i)}&limit=1`}),select:v=>v.results.map(r=>({name:r.openfda?.generic_name,updated:r.effective_time,purpose:r.purpose,warnings:r.warnings,do_not_use:r.do_not_use}))})
];
