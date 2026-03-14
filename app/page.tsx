import { OrdersDashboard } from "@/components/dashboard/orders-dashboard";
import { mockOrders } from "@/data/orders";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <OrdersDashboard orders={mockOrders} />
      </div>
    </main>
  );
}
