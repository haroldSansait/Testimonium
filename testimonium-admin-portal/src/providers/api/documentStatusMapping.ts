export function mapDocumentStatusToBackend(status: string | undefined): string | undefined {
  switch (status) {
    case 'Pending Review': return 'PENDING';
    case 'Under Review': return 'UNDER_REVIEW';
    case 'Needs Correction': return 'NEEDS_CORRECTION';
    case 'Payment Pending': return 'PAYMENT_PENDING';
    case 'Awaiting Payment Review': return 'PAYMENT_UNDER_REVIEW';
    case 'Payment Needs Correction': return 'PAYMENT_NEEDS_CORRECTION';
    case 'Payment Verified': return 'PAYMENT_VERIFIED';
    case 'Processing': return 'PROCESSING';
    case 'Ready for Signing': return 'READY_FOR_SIGNING';
    case 'Ready for Pickup': return 'READY_FOR_PICKUP';
    case 'Released':
    case 'Completed': return 'COMPLETED';
    case 'Rejected': return 'REJECTED';
    case 'Cancelled': return 'CANCELLED';
    default: return status;
  }
}
