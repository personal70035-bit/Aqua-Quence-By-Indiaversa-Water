export async function callAPI() {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "AIzaSyBUzPtI1oBJdbgpF6ZSlgDZ-akn1IKjwKE",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input: "Hello"
    })
  });

  return await res.json();
}
