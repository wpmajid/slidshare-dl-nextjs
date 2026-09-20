import './globals.css';

export const metadata = {
  title: 'SlideShare Downloader',
  description: 'Download SlideShare slides as ZIP, PDF or PPTX',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
