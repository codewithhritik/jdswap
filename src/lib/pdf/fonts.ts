import { Font } from "@react-pdf/renderer";
import path from "path";

let fontsRegistered = false;

export function registerFonts() {
  if (fontsRegistered) return;

  const fontsDir = path.resolve(process.cwd(), "public/fonts");

  Font.register({
    family: "EBGaramond",
    fonts: [
      {
        src: path.join(fontsDir, "EBGaramond-Regular.ttf"),
        fontWeight: "normal",
      },
      {
        src: path.join(fontsDir, "EBGaramond-Regular.ttf"),
        fontWeight: "bold",
      },
      {
        src: path.join(fontsDir, "EBGaramond-Italic.ttf"),
        fontStyle: "italic",
      },
      {
        src: path.join(fontsDir, "EBGaramond-Italic.ttf"),
        fontWeight: "bold",
        fontStyle: "italic",
      },
    ],
  });

  fontsRegistered = true;
}
