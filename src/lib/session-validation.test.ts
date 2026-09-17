// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {AUTH_SESSION_VALIDATION_EVENT,sessionAwareFetch} from "./session-validation";
afterEach(()=>vi.unstubAllGlobals());
describe("revoked data action boundary",()=>{
 it("requests authoritative validation without consuming the error response",async()=>{const listener=vi.fn();window.addEventListener(AUTH_SESSION_VALIDATION_EVENT,listener);vi.stubGlobal("fetch",vi.fn(async()=>Response.json({message:"ACCOUNT_SESSION_REVOKED"},{status:403})));const response=await sessionAwareFetch("https://database.test/rest/v1/rpc/save_personal_content");expect(listener).toHaveBeenCalledOnce();expect(await response.json()).toEqual({message:"ACCOUNT_SESSION_REVOKED"});window.removeEventListener(AUTH_SESSION_VALIDATION_EVENT,listener);});
 it("does not loop on failed status checks or unrelated authorization denials",async()=>{const listener=vi.fn();window.addEventListener(AUTH_SESSION_VALIDATION_EVENT,listener);vi.stubGlobal("fetch",vi.fn(async()=>Response.json({message:"permission denied"},{status:403})));await sessionAwareFetch("https://database.test/rest/v1/profiles");vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:401})));await sessionAwareFetch("https://database.test/rest/v1/rpc/get_account_session_status");expect(listener).not.toHaveBeenCalled();window.removeEventListener(AUTH_SESSION_VALIDATION_EVENT,listener);});
});
