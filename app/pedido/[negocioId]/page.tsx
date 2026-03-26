import { StorefrontOrderWizard } from "@/components/storefront/order-wizard";
import { getBusinessBySlugWithProducts } from "@/data/businesses";
import { createStorefrontOrderPage } from "@/lib/page-contracts/storefront-order-page";

const StorefrontOrderPage = createStorefrontOrderPage({
  getBusinessBySlugWithProducts,
  StorefrontOrderWizard,
});

export default StorefrontOrderPage;
