export async function callAPI() {
  const res = await fetch("https://aquaquece-by-indiverswater.personal-70035.workers.dev/");
  return await res.json();
}
