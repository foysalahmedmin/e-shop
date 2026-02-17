import Header from "../shared/widgets/header";
import "./global.css";
import { Oregano, Poppins, Roboto } from "next/font/google";
import Providers from "./providers";
import Footer from "../shared/widgets/footer";

export const metadata = {
  title: "Eshop",
  description: "Eshop",
};

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "700", "900"],
  variable: "--font-roboto",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

const oregano = Oregano({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-oregano",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${roboto.variable} ${oregano.variable} ${poppins.variable} bg-[#f5f5f5]`}
      >
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
