export const documentStatusGroups = [
  {
    groupName: 'Review & Correction',
    options: [
      { value: 'PENDING', label: 'Pending Review' },
      { value: 'UNDER_REVIEW', label: 'Under Review' },
      { value: 'NEEDS_CORRECTION', label: 'Needs Correction' },
    ],
  },
  {
    groupName: 'Payment Stages',
    options: [
      { value: 'PAYMENT_PENDING', label: 'Payment Pending' },
      { value: 'PAYMENT_UNDER_REVIEW', label: 'Payment Under Review' },
      { value: 'PAYMENT_NEEDS_CORRECTION', label: 'Payment Needs Correction' },
      { value: 'PAYMENT_VERIFIED', label: 'Payment Verified' },
    ],
  },
  {
    groupName: 'Processing & Fulfillment',
    options: [
      { value: 'PROCESSING', label: 'Processing' },
      { value: 'READY_FOR_SIGNING', label: 'Ready for Signing' },
      { value: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
      { value: 'RETURNED', label: 'Returned for Correction' },
    ],
  },
  {
    groupName: 'Final / Resolved',
    options: [
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'REJECTED', label: 'Rejected' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
  },
];
