
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white dark:bg-gray-medium shadow-md">
      <div className="container mx-auto px-4 md:px-8 py-4">
        <h1 className="text-2xl md:text-3xl font-bold text-brand-primary dark:text-brand-light">
          Sales Navigator Client Matcher
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Find your clients and identify their city for your next business trip.
        </p>
      </div>
    </header>
  );
};

export default Header;
