defmodule SchedulerWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :scheduler

  plug Plug.Static, at: "/", from: :scheduler, gzip: false
  plug Plug.Parsers, parsers: [:json], pass: [], json_decoder: Jason
  plug SchedulerWeb.Router
end

defmodule SchedulerWeb.Router do
  use Phoenix.Router
  import Phoenix.Controller

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", SchedulerWeb do
    pipe_through :api
    get "/tasks", TaskController, :index
    post "/tasks", TaskController, :create
    post "/tasks/:id/retry", TaskController, :retry
    post "/tasks/:id/cancel", TaskController, :cancel
    post "/tasks/:id/notify", TaskController, :notify
    get "/stats", TaskController, :stats
    get "/nodes", TaskController, :nodes
    get "/notifications", NotificationController, :index
    get "/notifications/:id", NotificationController, :show
    get "/notifications/stats/summary", NotificationController, :stats
    post "/notifications", NotificationController, :create
    post "/notifications/:id/confirm", NotificationController, :confirm
    post "/notifications/:id/reject", NotificationController, :reject
  end
end

defmodule SchedulerWeb.TaskController do
  use Phoenix.Controller, formats: [:json]

  def index(conn, _params) do
    tasks = Scheduler.TaskManager.list_tasks()
    json(conn, %{tasks: Enum.map(tasks, &Map.from_struct/1)})
  end

  def create(conn, %{"name" => name}) do
    task = Scheduler.TaskManager.add_task(name)
    json(conn, %{task: Map.from_struct(task)})
  end

  def retry(conn, %{"id" => id}) do
    Scheduler.TaskManager.retry_task(id)
    json(conn, %{status: "ok"})
  end

  def cancel(conn, %{"id" => id}) do
    Scheduler.TaskManager.cancel_task(id)
    json(conn, %{status: "ok"})
  end

  def notify(conn, %{"id" => id} = params) do
    owner = Map.get(params, "owner")
    if owner do
      Scheduler.TaskManager.notify_task(id, owner)
      task = Enum.find(Scheduler.TaskManager.list_tasks(), &(&1.id == id))
      notif_params = %{
        "task_id" => id,
        "task_name" => task && task.name || id,
        "owner" => owner,
        "message" => Map.get(params, "message"),
        "priority" => Map.get(params, "priority", "medium"),
        "deadline" => Map.get(params, "deadline"),
        "result_summary" => Map.get(params, "result_summary"),
        "external_contacts" => Map.get(params, "external_contacts", []),
        "cc_list" => Map.get(params, "cc_list", [])
      }
      notification = Scheduler.NotificationManager.create_notification(notif_params)
      json(conn, %{status: "ok", notification: Map.from_struct(notification)})
    else
      conn
      |> put_status(:bad_request)
      |> json(%{error: "owner is required"})
    end
  end

  def stats(conn, _params) do
    json(conn, Scheduler.TaskManager.get_stats())
  end

  def nodes(conn, _params) do
    nodes = for i <- 1..5 do
      %{
        id: "node-#{i}",
        name: if(i == 1, do: "scheduler-main", else: "worker-#{i - 1}"),
        type: if(i == 1, do: "scheduler", else: "worker"),
        status: if(:rand.uniform() > 0.1, do: "online", else: "overloaded"),
        cpu: 20 + :rand.uniform() * 60,
        memory: 30 + :rand.uniform() * 50,
        tasks: :rand.uniform(8),
        uptime: 3600 + :rand.uniform(86400)
      }
    end
    json(conn, %{nodes: nodes})
  end
end

defmodule SchedulerWeb.ErrorJSON do
  def render(template, _assigns) do
    %{errors: %{detail: Phoenix.Controller.status_message_from_template(template)}}
  end
end

defmodule SchedulerWeb.NotificationController do
  use Phoenix.Controller, formats: [:json]

  def index(conn, params) do
    filters = Map.take(params, ["status", "owner", "priority"])
    notifications = Scheduler.NotificationManager.list_notifications(filters)
    json(conn, %{notifications: Enum.map(notifications, &Map.from_struct/1)})
  end

  def show(conn, %{"id" => id}) do
    case Scheduler.NotificationManager.get_notification(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Notification not found"})
      notif ->
        json(conn, %{notification: Map.from_struct(notif)})
    end
  end

  def stats(conn, _params) do
    json(conn, Scheduler.NotificationManager.get_stats())
  end

  def create(conn, params) do
    with {:ok, task_id} <- Map.fetch(params, "task_id"),
         {:ok, task_name} <- Map.fetch(params, "task_name"),
         {:ok, owner} <- Map.fetch(params, "owner") do
      notification = Scheduler.NotificationManager.create_notification(params)
      Scheduler.TaskManager.notify_task(task_id, owner)
      json(conn, %{status: "ok", notification: Map.from_struct(notification)})
    else
      :error ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "task_id, task_name and owner are required"})
    end
  end

  def confirm(conn, %{"id" => id} = params) do
    remark = Map.get(params, "remark")
    Scheduler.NotificationManager.confirm_notification(id, remark)
    notif = Scheduler.NotificationManager.get_notification(id)
    if notif, do: Scheduler.TaskManager.update_notification(notif.task_id, "confirmed")
    json(conn, %{status: "ok"})
  end

  def reject(conn, %{"id" => id} = params) do
    reason = Map.get(params, "reason")
    Scheduler.NotificationManager.reject_notification(id, reason)
    notif = Scheduler.NotificationManager.get_notification(id)
    if notif, do: Scheduler.TaskManager.update_notification(notif.task_id, "rejected")
    json(conn, %{status: "ok"})
  end
end
