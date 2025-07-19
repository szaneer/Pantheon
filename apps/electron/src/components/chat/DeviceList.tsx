import React from 'react';
import { Monitor, Wifi, WifiOff } from 'lucide-react';
import { Device } from '../../services/deviceService';

interface DeviceListProps {
  devices: Device[];
}

export const DeviceList: React.FC<DeviceListProps> = ({ devices }) => {
  return (
    <div className="space-y-2">
      {devices.map(device => (
        <div
          key={device.id}
          className={`flex items-center p-2 rounded-md ${
            device.isOnline 
              ? 'text-gray-300' 
              : 'text-gray-500 opacity-50'
          }`}
        >
          <Monitor className="w-4 h-4 mr-2" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{device.name}</p>
            <p className="text-xs text-gray-400 truncate">{device.platform}</p>
            {device.models.length > 0 && (
              <p className="text-xs text-blue-400 truncate">
                {device.models.length} models
              </p>
            )}
          </div>
          {device.isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
        </div>
      ))}
    </div>
  );
};