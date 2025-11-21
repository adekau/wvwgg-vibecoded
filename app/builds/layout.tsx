import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Build Editor | wvwgg',
  description: 'Create and optimize your Guild Wars 2 builds with gear optimizer and advanced stat calculations',
}

export default function BuildsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
