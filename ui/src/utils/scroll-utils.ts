export const scrollToSection = (section: 'top' | 'bottom' | 'requests' | 'contents'): void => {
  if (section === 'top') {
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else if (section === 'bottom') {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
  } else if (section === 'requests' || section === 'contents') {
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'instant' });
    }
  }
};
