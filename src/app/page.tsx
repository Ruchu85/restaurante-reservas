import Link from "next/link";
import { Scissors, Clock, Star, Phone, MapPin, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

const SALON_SLUG = process.env.NEXT_PUBLIC_SALON_SLUG ?? "salon-demo";

export default async function LandingPage() {
  const supabase = await createClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("*")
    .eq("slug", SALON_SLUG)
    .single();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("price_cents")
    .limit(6);

  const salonName = salon?.name ?? "Salón Demo";
  const salonAddress = salon?.address ?? "Madrid";
  const salonPhone = salon?.phone ?? "+34 600 000 000";

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Scissors className="h-6 w-6" />
            <span className="text-lg font-bold">{salonName}</span>
          </div>
          <nav className="hidden gap-6 md:flex">
            <a href="#servicios" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Servicios
            </a>
            <a href="#nosotros" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Nosotros
            </a>
            <a href="#contacto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contacto
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Panel admin</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/reservar">
                Reservar cita
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-24 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4 bg-white/10 text-white border-white/20">
            ✨ Reserva tu momento de bienestar
          </Badge>
          <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            Tu cabello merece
            <br />
            <span className="text-amber-400">el mejor cuidado</span>
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg text-slate-300">
            Reserva tu cita en segundos. Profesionales expertos, resultados
            excepcionales. Sin esperas, sin llamadas.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold px-8">
              <Link href="/reservar">
                Reservar ahora — es gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
              <a href="#servicios">Ver servicios</a>
            </Button>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              Sin pago anticipado
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              Cancelación gratuita
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              Confirmación instantánea
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b bg-slate-50 py-12">
        <div className="container mx-auto grid grid-cols-2 gap-8 px-4 md:grid-cols-4">
          {[
            { label: "Clientes satisfechos", value: "+2.000" },
            { label: "Años de experiencia", value: "15+" },
            { label: "Valoración media", value: "4.9 ★" },
            { label: "Servicios disponibles", value: (services?.length ?? 5).toString() },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICIOS */}
      <section id="servicios" className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">Nuestros servicios</h2>
            <p className="mt-2 text-muted-foreground">
              Elige el tratamiento que más te conviene
            </p>
          </div>
          {services && services.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <Card key={service.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 group-hover:bg-amber-100 transition-colors">
                        <Scissors className="h-5 w-5 text-slate-600 group-hover:text-amber-600 transition-colors" />
                      </div>
                      <h3 className="font-semibold">{service.name}</h3>
                    </div>
                    {service.description && (
                      <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                        {service.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {service.duration_minutes} min
                      </div>
                      <div className="text-lg font-bold">
                        {(service.price_cents / 100).toLocaleString("es-ES", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </div>
                    </div>
                    <Button asChild className="mt-4 w-full" variant="outline" size="sm">
                      <Link href={`/reservar?service=${service.id}`}>
                        Reservar este servicio
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Cargando servicios…
            </div>
          )}
          <div className="mt-10 text-center">
            <Button asChild size="lg">
              <Link href="/reservar">
                Ver disponibilidad y reservar
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* POR QUÉ NOSOTROS */}
      <section id="nosotros" className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">¿Por qué elegirnos?</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Star,
                title: "Profesionales expertos",
                desc: "Nuestro equipo cuenta con años de formación y experiencia en las últimas tendencias.",
              },
              {
                icon: Clock,
                title: "Puntualidad garantizada",
                desc: "Respetamos tu tiempo. Cada cita tiene su espacio reservado sin esperas innecesarias.",
              },
              {
                icon: CheckCircle,
                title: "Productos de calidad",
                desc: "Trabajamos solo con marcas premium para garantizar el mejor resultado y cuidado.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-20 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">¿Listo para tu cambio de look?</h2>
          <p className="text-slate-300 mb-8 max-w-md mx-auto">
            Reserva ahora en menos de 2 minutos. Sin registro obligatorio.
          </p>
          <Button asChild size="lg" className="bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold">
            <Link href="/reservar">
              Reservar cita gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contacto" className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Scissors className="h-5 w-5" />
                <span className="font-bold">{salonName}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Tu salón de confianza en Madrid.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Contacto</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  {salonAddress}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  {salonPhone}
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Horario</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Lunes — Viernes: 9:00 — 20:00</div>
                <div>Sábado: 9:00 — 14:00</div>
                <div>Domingo: Cerrado</div>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} {salonName}. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
