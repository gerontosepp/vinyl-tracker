import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-2 text-center text-xs text-gray-400 mt-auto">
      v{__APP_VERSION__}
    </footer>
  );
};

export default Footer;
