import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iluzia My Class | XR Learning Management System",
  description: "Experience immersive 3D learning with Iluzia My Class - the next generation XR Learning Management System powered by experiential education technology.",
  keywords: "XR learning, 3D education, immersive learning, LMS, experiential learning",
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
