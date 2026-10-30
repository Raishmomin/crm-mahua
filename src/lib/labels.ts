export type ModuleKey =
  | 'dashboard'
  | 'leads'
  | 'buyers'
  | 'samples'
  | 'quotes'
  | 'orders'
  | 'payments'
  | 'catalog'
  | 'documents'
  | 'reports'
  | 'users'
  | 'settings'
  | 'audit';

export type UserRole = 'owner' | 'accountant' | 'sales' | 'operations';

export interface NavItem {
  key: ModuleKey;
  label: string;
  href: string;
  icon: string;
  description: string;
}

export const ROLE_PRESETS: Record<UserRole, ModuleKey[]> = {
  owner: [
    'dashboard',
    'leads',
    'buyers',
    'samples',
    'quotes',
    'orders',
    'payments',
    'catalog',
    'documents',
    'reports',
    'users',
    'settings',
    'audit',
  ],
  accountant: [
    'dashboard',
    'buyers',
    'quotes',
    'orders',
    'payments',
    'catalog',
    'documents',
    'reports',
    'settings',
    'audit',
  ],
  sales: [
    'dashboard',
    'leads',
    'buyers',
    'samples',
    'quotes',
    'orders',
    'catalog',
    'documents',
    'reports',
  ],
  operations: [
    'dashboard',
    'buyers',
    'samples',
    'orders',
    'catalog',
    'documents',
  ],
};

export const ALL_MODULES: { key: ModuleKey; label: string; description: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'Real-time KPIs, pending actions and alerts', icon: 'LayoutDashboard' },
  { key: 'leads', label: 'Inquiries', description: 'Inquiry pipeline and buyer requirement capture', icon: 'Inbox' },
  { key: 'buyers', label: 'Buyers', description: 'Domestic masala makers, export food importers and agents', icon: 'Building2' },
  { key: 'samples', label: 'Samples', description: 'Sample requests, lab approval, dispatch tracking', icon: 'FlaskConical' },
  { key: 'quotes', label: 'Quotations', description: 'Multi-currency quotations with floor price guard', icon: 'FileSpreadsheet' },
  { key: 'orders', label: 'Orders', description: 'Sales orders, partial shipment schedules and status', icon: 'ShoppingBag' },
  { key: 'payments', label: 'Payments', description: 'Advances, balance receipts and bank reconciliations', icon: 'CreditCard' },
  { key: 'catalog', label: 'Products & Prices', description: 'Flakes, minced, powder, packaging and price tiers', icon: 'Package' },
  { key: 'documents', label: 'Document Register', description: 'Immutable invoices, quotations and dispatch notes', icon: 'FileText' },
  { key: 'reports', label: 'Reports', description: 'Receivables aging, conversion and buyer statements', icon: 'BarChart3' },
  { key: 'users', label: 'Users & Access', description: 'Team member roles and granular module permissions', icon: 'Users' },
  { key: 'settings', label: 'Settings', description: 'GSTIN, IEC, bank accounts, HSN and factory defaults', icon: 'Settings' },
  { key: 'audit', label: 'Activity Log', description: 'Immutable audit trail of all transactions and changes', icon: 'ShieldCheck' },
];

export const MAIN_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Home', href: '/', icon: 'LayoutDashboard', description: 'Role-aware operational summary' },
  { key: 'leads', label: 'Inquiries', href: '/inquiries', icon: 'Inbox', description: 'Manage buyer inquiries' },
  { key: 'buyers', label: 'Buyers', href: '/buyers', icon: 'Building2', description: 'Buyer 360 and contacts' },
  { key: 'samples', label: 'Samples', href: '/samples', icon: 'FlaskConical', description: 'Sample dispatch and tests' },
  { key: 'quotes', label: 'Quotations', href: '/quotes', icon: 'FileSpreadsheet', description: 'Issued quotes and approvals' },
  { key: 'orders', label: 'Orders', href: '/orders', icon: 'ShoppingBag', description: 'Order book and fulfillment' },
  { key: 'payments', label: 'Receivables', href: '/payments', icon: 'CreditCard', description: 'Payments and aging' },
  { key: 'catalog', label: 'Catalog', href: '/catalog', icon: 'Package', description: 'Products, grades and packaging' },
  { key: 'documents', label: 'Documents', href: '/documents', icon: 'FileText', description: 'Tax invoices and receipts' },
  { key: 'reports', label: 'Reports', href: '/reports', icon: 'BarChart3', description: 'Pipeline and financial reports' },
  { key: 'users', label: 'Users', href: '/users', icon: 'Users', description: 'Staff members and permissions' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: 'Settings', description: 'Organization configuration' },
  { key: 'audit', label: 'Activity Log', href: '/audit', icon: 'ShieldCheck', description: 'System audit logs' },
];

export const LABELS = {
  appName: 'Mahuva CRM',
  tagline: 'Dehydrated Onion Processing & Export Management',
  auth: {
    loginTitle: 'Sign In to Your Workspace',
    loginSubtitle: 'Enter your work credentials to access your tenant dashboard',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    signInButton: 'Sign In',
    signingIn: 'Verifying credentials...',
    invalidCredentials: 'Invalid email or password. Please try again.',
    accountInactive: 'Your account has been deactivated by the organization admin.',
    accessDeniedTitle: 'Access Restricted',
    accessDeniedDesc: 'You do not have permission to view this module. Please contact your administrator to assign the module.',
    signOut: 'Sign Out',
  },
  common: {
    searchPlaceholder: 'Search by code, buyer name, or reference...',
    loading: 'Loading data...',
    save: 'Save Changes',
    saving: 'Saving...',
    cancel: 'Cancel',
    create: 'Create New',
    edit: 'Edit',
    delete: 'Delete',
    back: 'Go Back',
    refresh: 'Refresh',
    emptyTitle: 'No records found',
    emptyDesc: 'Get started by creating a new entry or adjusting your filters.',
    errorTitle: 'Something went wrong',
    errorDesc: 'Unable to load records. Please retry or contact technical support.',
    retry: 'Retry',
    actions: 'Actions',
    status: 'Status',
    createdAt: 'Created At',
  },
  users: {
    title: 'Users & Module Permissions',
    subtitle: 'Manage team access, roles, and fine-tune module entitlements per user.',
    addUser: 'Add Team Member',
    colName: 'Name',
    colEmail: 'Email',
    colRole: 'Role Preset',
    colModules: 'Assigned Modules',
    colStatus: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    editModules: 'Edit Modules',
    modalTitle: 'Configure Access Permissions',
    savePermissions: 'Save Permissions',
  },
  settings: {
    title: 'Organization Settings',
    subtitle: 'Company legal registration, GSTIN, IEC, bank details, and financial parameters.',
    companyDetailsTab: 'Business Identity',
    taxBankTab: 'Tax & Bank Details',
    docPrefixTab: 'Doc Counters & Defaults',
    companyName: 'Company Name',
    tradeName: 'Trade / Brand Name',
    gstin: 'GSTIN',
    iecCode: 'Import Export Code (IEC)',
    pan: 'PAN Number',
    fssaiNo: 'FSSAI License No.',
    address: 'Factory / Registered Address',
    city: 'City',
    state: 'State',
    pincode: 'PIN Code',
    country: 'Country',
    bankName: 'Bank Name',
    bankAccountNo: 'Account Number',
    bankIfsc: 'IFSC Code',
    bankBranch: 'Branch Name',
    swiftCode: 'SWIFT Code (for Export)',
    authorizedSignatory: 'Authorized Signatory',
    contactEmail: 'Official Email',
    contactPhone: 'Official Phone',
  },
};
