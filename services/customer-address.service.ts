import { NotFoundError } from '@/lib/errors';
import { CustomerRepository } from '@/repositories/customer.repository';

export class CustomerAddressService {
  public constructor(private readonly customers = new CustomerRepository()) {}

  public async getOwnedAddress(customerId: string, addressId: string) {
    const address = await this.customers.findOwnedAddress(
      customerId,
      addressId,
    );
    if (!address) throw new NotFoundError('Address was not found.');
    return address;
  }
}
