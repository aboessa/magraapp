const KEY="pv_pGsel6vL3VLUrmdoRV8PpyE3oHxtDVbu";
const BASE_DIRECT="https://playveo-api.aboessa101.workers.dev";
const BASE_PROXY="http://127.0.0.1:1420/api/playveo";
async function test(base, label){
  console.log(`\n=== ${label} -> ${base}/v1/videos ===`);
  try{
    const res = await fetch(`${base}/v1/videos`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${KEY}` },
      body: JSON.stringify({ prompt:"Premium calm stylized 3D preschool animation test, a girl waves in a garden, 16:9", aspect_ratio:"16:9", duration_seconds:4 })
    });
    const text = await res.text();
    console.log(`HTTP ${res.status} ${res.statusText}`);
    console.log(text.slice(0,3000));
  }catch(e){
    console.log(`FETCH THREW: ${e.name}: ${e.message}`);
    console.log(String(e.cause || ""));
    console.log(String(e.stack||"").slice(0,1500));
  }
}
await test(BASE_DIRECT, "DIRECT");
await test(BASE_PROXY, "VITE-PROXY");
