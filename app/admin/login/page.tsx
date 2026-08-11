import { Card, CardBody } from "@/components/ui/Card";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mist-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo variant="dark" />
          <p className="mt-3 text-sm text-ink-700/70">Lodge Management</p>
        </div>
        <Card>
          <CardBody className="py-8">
            <LoginForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
