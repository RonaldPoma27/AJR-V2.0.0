import { Link } from "react-router-dom";
import { usePartners } from "@/api/partners";

export default function Home() {
  const { data: partners } = usePartners();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">
          Software a medida que hace más competitiva a tu PyME
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          En AJR Data resolvemos falencias concretas de tu negocio con
          desarrollo a medida — incorporando chatbots, agentes de IA y
          funcionalidades modernas en vez de soluciones genéricas.
        </p>
        <Link
          to="/solicitar-proyecto"
          className="mt-8 inline-block rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
        >
          Solicitar un proyecto
        </Link>
      </section>

      <section className="mt-20">
        <h2 className="text-center text-2xl font-semibold text-gray-900">
          Quiénes somos
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
          Somos una consultora tecnológica enfocada en ayudar a PyMEs a
          resolver problemas puntuales de su negocio mediante software,
          diferenciándonos con ideas más modernas que la competencia de
          nuestros clientes.
        </p>
      </section>

      {partners && partners.length > 0 && (
        <section className="mt-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            Con quiénes trabajamos
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-10">
            {partners.map((p) => (
              <div key={p.id} className="text-center text-gray-500">
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} className="h-10" />
                ) : (
                  <span className="font-medium">{p.name}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
