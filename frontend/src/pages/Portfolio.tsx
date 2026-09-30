import { useProjects } from "@/api/projects";

export default function Portfolio() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Portfolio</h1>
      <p className="mt-2 text-gray-600">Trabajos hechos y proyectos en progreso.</p>

      {isLoading && <p className="mt-8 text-gray-500">Cargando...</p>}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <article key={project.id} className="rounded-lg border p-5 shadow-sm">
            {project.image_url && (
              <img
                src={project.image_url}
                alt={project.title}
                className="mb-4 h-40 w-full rounded-md object-cover"
              />
            )}
            <span
              className={
                project.status === "terminado"
                  ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                  : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
              }
            >
              {project.status === "terminado" ? "Terminado" : "En progreso"}
            </span>
            <h3 className="mt-3 text-lg font-semibold text-gray-900">
              {project.title}
            </h3>
            <p className="mt-1 text-sm text-gray-600">{project.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
