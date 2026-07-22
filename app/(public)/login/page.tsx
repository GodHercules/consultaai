import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[]; registered?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const nextParam = searchParams.next;
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  const errorParam = searchParams.error;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;
  const registeredParam = searchParams.registered;
  const registered = (Array.isArray(registeredParam) ? registeredParam[0] : registeredParam) === "1";

  return <LoginForm next={next} error={error} registered={registered} />;
}
