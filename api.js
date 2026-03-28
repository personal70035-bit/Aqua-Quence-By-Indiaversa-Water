export default {
  async fetch(request) {
    return new Response(JSON.stringify({
      status: "WORKING",
      message: "Worker is live"
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
