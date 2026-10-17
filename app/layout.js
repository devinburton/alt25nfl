import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "ALT25 | Sports Totals Intelligence",
  description: "Model-driven totals analysis across NFL, NCAA football, NBA, WNBA and MLB."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
