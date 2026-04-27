import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iLuZia Lab | XR Learning Management System",
  description: "Experience immersive 3D learning with iLuZia Lab - the next generation XR Learning Management System powered by experiential education technology.",
  keywords: "XR learning, 3D education, immersive learning, LMS, experiential learning, iLuZia Lab",
  icons: {
    icon: "/iluzia-logo.png",
    apple: "/iluzia-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
