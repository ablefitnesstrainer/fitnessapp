import "./globals.css";

export const metadata = {
  title: "Able Fitness Coaching App",
  description: "Fitness coaching platform",
  icons: {
    icon: "/able-logo-official.png",
    shortcut: "/able-logo-official.png",
    apple: "/able-logo-official.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
