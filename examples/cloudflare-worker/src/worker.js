import { APP_VERSION } from "./version.js";

export default {
  async fetch() {
    return new Response(`${APP_VERSION}\n`, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
