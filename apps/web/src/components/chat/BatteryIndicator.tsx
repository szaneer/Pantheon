import React from 'react';
import { Battery, BatteryCharging } from 'lucide-react';
import { BatteryState } from '../../services/p2pClientServiceV2';

interface BatteryIndicatorProps {
  batteryState?: BatteryState;
  className?: string;
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({ 
  batteryState, 
  className = '' 
}) => {
  if (!batteryState) return null;

  const { isCharging, percentage, isOnBatteryPower } = batteryState;
  
  // Determine battery color based on percentage
  let batteryColor = 'text-green-500';
  if (percentage !== null) {
    if (percentage <= 20) {
      batteryColor = 'text-red-500';
    } else if (percentage <= 50) {
      batteryColor = 'text-yellow-500';
    }
  }

  const Icon = isCharging ? BatteryCharging : Battery;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Icon className={`w-4 h-4 ${batteryColor}`} />
      {percentage !== null && (
        <span className={`text-xs ${batteryColor}`}>
          {percentage}%
        </span>
      )}
    </div>
  );
};