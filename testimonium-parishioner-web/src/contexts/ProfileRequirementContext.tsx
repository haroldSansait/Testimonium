import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { ProfileCompletionModal } from '../components/modals/ProfileCompletionModal';

export interface ProfileRequirementContextType {
  isProfileIncomplete: boolean;
  requireCompleteProfile: (onAllowed: () => void, serviceName?: string) => void;
  openProfileModal: (serviceName?: string) => void;
  closeProfileModal: () => void;
  isProfileModalOpen: boolean;
  profileModalServiceName: string;
}

const ProfileRequirementContext = createContext<ProfileRequirementContextType | undefined>(undefined);

export const ProfileRequirementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appProfile } = useAuth();
  const isProfileIncomplete = Boolean(appProfile?.needsProfileCompletion);

  const [isOpen, setIsOpen] = useState(false);
  const [serviceName, setServiceName] = useState('proceed with requests');

  const requireCompleteProfile = useCallback(
    (onAllowed: () => void, targetServiceName = 'proceed with requests') => {
      if (isProfileIncomplete) {
        setServiceName(targetServiceName);
        setIsOpen(true);
      } else {
        onAllowed();
      }
    },
    [isProfileIncomplete]
  );

  const openProfileModal = useCallback((targetServiceName = 'proceed with requests') => {
    setServiceName(targetServiceName);
    setIsOpen(true);
  }, []);

  const closeProfileModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <ProfileRequirementContext.Provider
      value={{
        isProfileIncomplete,
        requireCompleteProfile,
        openProfileModal,
        closeProfileModal,
        isProfileModalOpen: isOpen,
        profileModalServiceName: serviceName,
      }}
    >
      {children}
      <ProfileCompletionModal
        isOpen={isOpen}
        onClose={closeProfileModal}
        serviceName={serviceName}
      />
    </ProfileRequirementContext.Provider>
  );
};

export const useProfileRequirement = (): ProfileRequirementContextType => {
  const context = useContext(ProfileRequirementContext);
  if (!context) {
    throw new Error('useProfileRequirement must be used within a ProfileRequirementProvider');
  }
  return context;
};

export default ProfileRequirementContext;
