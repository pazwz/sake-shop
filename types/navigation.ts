export type HeaderNavigationLink = {
  label: string;
  href: string;
};

export type HeaderNavigationGroup = {
  id: string;
  label: string;
  href: string;
  links: HeaderNavigationLink[];
};
