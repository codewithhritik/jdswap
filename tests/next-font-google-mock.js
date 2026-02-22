const fontPath = "/Users/hrithik/Documents/Work/jdswap/public/fonts/EBGaramond-Regular.ttf";

module.exports = {
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&display=swap":
    `@font-face {
      font-family: "Instrument Serif";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url(${fontPath}) format("truetype");
    }
    @font-face {
      font-family: "Instrument Serif";
      font-style: italic;
      font-weight: 400;
      font-display: swap;
      src: url(${fontPath}) format("truetype");
    }`,
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@200..800&display=swap":
    `@font-face {
      font-family: "Bricolage Grotesque";
      font-style: normal;
      font-weight: 200 800;
      font-display: swap;
      src: url(${fontPath}) format("truetype");
    }`,
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap":
    `@font-face {
      font-family: "IBM Plex Mono";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url(${fontPath}) format("truetype");
    }
    @font-face {
      font-family: "IBM Plex Mono";
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(${fontPath}) format("truetype");
    }`,
};
