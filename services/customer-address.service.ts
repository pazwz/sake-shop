import { NotFoundError } from '@/lib/errors';
import { CustomerAddressRepository } from '@/repositories/customer-address.repository';
import type { CustomerAddressInput } from '@/validators/customer-account.validator';

export class CustomerAddressService {
  public constructor(
    private readonly addresses = new CustomerAddressRepository(),
  ) {}

  public list(customerId: string) {
    return this.addresses.list(customerId);
  }

  public async getOwnedAddress(customerId: string, addressId: string) {
    const address = await this.addresses.findOwned(customerId, addressId);
    if (!address) throw new NotFoundError('Address was not found.');
    return address;
  }

  public create(customerId: string, input: CustomerAddressInput) {
    return this.addresses.create(customerId, input);
  }

  public async update(
    customerId: string,
    addressId: string,
    input: CustomerAddressInput,
  ) {
    const address = await this.addresses.update(customerId, addressId, input);
    if (!address) throw new NotFoundError('Address was not found.');
    return address;
  }

  public async delete(customerId: string, addressId: string) {
    const result = await this.addresses.delete(customerId, addressId);
    if (!result) throw new NotFoundError('Address was not found.');
    return result;
  }
}
