// Marks all exported functions as Server Actions. These can be used in Client and Server components.
// Any functions included in this file that are NOT used will be automatically removed from the
// final application bundle.
// Behind the scenes, Server Actions create a POST API endpoint. Thus, it's not needed to create it
// manually to use it.
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  // If working with many fields, use entries() method with JS Object.fromEntries();
  const rawFormData = {
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  };

  // Being this a Server Action, the logs will be shown only in the terminal. Not in the browser.
  console.log(rawFormData);
  console.log(typeof rawFormData.amount) // string

  const { customerId, amount, status } = CreateInvoice.parse(rawFormData);
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;

  // NextJS has a client-side router CACHE that stores the route segments in the user's browser for
  // a time. Along with prefetching, this cache ensures that users can quickly navigate between routes
  // while reducing the number of requests made to the server.
  // Since we added a new invoice item, thus updating the data displayed in the /invoices route,
  // we want to CLEAR this cache and trigger a new request to the server.
  revalidatePath("/dashboard/invoices");

  redirect("/dashboard/invoices");
}

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  const amountInCents = amount * 100;
 
  await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
 
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}
