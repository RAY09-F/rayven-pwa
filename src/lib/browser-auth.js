import {timingSafeEqual} from './util.js';

// Browser command transport is separate from public status and from admin access.
export async function browserTransportAuthorized(request,env){
 const expected=env.BROWSER_CONTROL_TOKEN;
 const provided=request.headers.get('X-Asgard-Browser')||'';
 return typeof expected==='string'&&expected.length>=32&&provided.length<=512&&await timingSafeEqual(provided,expected);
}
