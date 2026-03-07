import "./globals.css";

export const metadata = {
  title: "Able Fitness Coaching App",
  description: "Fitness coaching platform",
  icons: {
    icon: "/able-logo.png",
    shortcut: "/able-logo.png",
    apple: "/able-logo.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
