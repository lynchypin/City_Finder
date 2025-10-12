import React from 'react';
import { Client } from '../types';
import ClientRow from './ClientRow';

interface ClientTableProps {
  clients: Client[];
  onCityChange: (id: number, city: string) => void;
  onFindCity: (id: number) => void;
}

const ClientTable: React.FC<ClientTableProps> = ({ clients, onCityChange, onFindCity }) => {
  const tableHeaders = ["Client Name", "Job Title", "Company", "Identified City", "Actions"];

  return (
    <div className="bg-white dark:bg-gray-medium rounded-lg shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
            <tr>
              {tableHeaders.map((header) => (
                <th key={header} scope="col" className="px-6 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => (
              <ClientRow
                key={client.id}
                client={client}
                onCityChange={onCityChange}
                onFindCity={onFindCity}
                isEven={index % 2 === 0}
              />
            ))}
          </tbody>
        </table>
      </div>
       {clients.length === 0 && (
         <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No client data found.</p>
            <p className="mt-2">Please check your Google Sheet or make sure it's accessible.</p>
         </div>
       )}
    </div>
  );
};

export default ClientTable;
