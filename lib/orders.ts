import type {Product} from './products';
export type Order={id:string;ownerEmail:string;createdAt:string;status:'発送準備中'|'発送済み';tracking:string;payment:string;delivery:Record<string,string>;items:{product:Product;quantity:number}[];subtotal:number;shipping:number};
export const ORDERS_KEY='kura-orders';
