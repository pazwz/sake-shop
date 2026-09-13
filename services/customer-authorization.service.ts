import { cookies } from 'next/headers';
import { CUSTOMER_SESSION_COOKIE } from '@/config/customer-auth';
import { UnauthorizedError } from '@/lib/errors';
import { CustomerAuthService } from '@/services/customer-auth.service';

const auth = new CustomerAuthService();

export const getCurrentCustomer = async () =>
  auth.getCustomer((await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value);

export const requireCustomer = async () => {
  const customer = await getCurrentCustomer();
  if (!customer)
    throw new UnauthorizedError('Customer authentication is required.');
  return customer;
};
