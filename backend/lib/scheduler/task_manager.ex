defmodule Scheduler.TaskManager do
  use GenServer

  defmodule Task do
    defstruct [:id, :name, :status, :node, :created_at, :retries, :max_retries, :logs, :owner, :notification_status]
  end

  # Client API
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def list_tasks, do: GenServer.call(__MODULE__, :list_tasks)

  def add_task(name) do
    GenServer.call(__MODULE__, {:add_task, name})
  end

  def retry_task(id), do: GenServer.call(__MODULE__, {:retry_task, id})

  def cancel_task(id), do: GenServer.call(__MODULE__, {:cancel_task, id})

  def get_stats, do: GenServer.call(__MODULE__, :get_stats)

  def notify_task(id, owner), do: GenServer.call(__MODULE__, {:notify_task, id, owner})

  def update_notification(id, status), do: GenServer.call(__MODULE__, {:update_notification, id, status})

  # Server callbacks
  @impl true
  def init(_) do
    # Seed some mock tasks
    owners = ~w[zhangsan lisi wangwu zhaoliu]
    tasks = for i <- 1..8 do
      name = Enum.at(~w[data_sync email_batch report_gen cache_warm log_rotate db_backup index_rebuild health_check], rem(i - 1, 8))
      status = Enum.at(~w[pending running success failed]a, :rand.uniform(4) - 1)
      owner = Enum.at(owners, rem(i - 1, 4))
      notif_status = if status == :success, do: Enum.at([nil, "sent", "confirmed", "rejected"], :rand.uniform(4) - 1), else: nil
      %Task{
        id: "task-#{1000 + i}",
        name: name,
        status: status,
        node: "worker-#{:rand.uniform(4)}",
        created_at: DateTime.utc_now(),
        retries: 0,
        max_retries: 3,
        logs: ["[INFO] Task #{name} created"],
        owner: owner,
        notification_status: notif_status
      }
    end
    {:ok, %{tasks: tasks, counter: 1009}}
  end

  @impl true
  def handle_call(:list_tasks, _from, state) do
    {:reply, state.tasks, state}
  end

  @impl true
  def handle_call({:add_task, name}, _from, state) do
    counter = state.counter + 1
    task = %Task{
      id: "task-#{counter}",
      name: name,
      status: :pending,
      node: "worker-#{:rand.uniform(4)}",
      created_at: DateTime.utc_now(),
      retries: 0,
      max_retries: 3,
      logs: ["[INFO] Task #{name} queued"]
    }
    {:reply, task, %{state | tasks: [task | state.tasks], counter: counter}}
  end

  @impl true
  def handle_call({:retry_task, id}, _from, state) do
    tasks = Enum.map(state.tasks, fn
      %{id: ^id} = t -> %{t | status: :pending, retries: t.retries + 1, logs: t.logs ++ ["[INFO] Retrying..."]}
      t -> t
    end)
    {:reply, :ok, %{state | tasks: tasks}}
  end

  @impl true
  def handle_call({:cancel_task, id}, _from, state) do
    tasks = Enum.map(state.tasks, fn
      %{id: ^id} = t -> %{t | status: :failed, logs: t.logs ++ ["[WARN] Cancelled"]}
      t -> t
    end)
    {:reply, :ok, %{state | tasks: tasks}}
  end

  @impl true
  def handle_call({:notify_task, id, owner}, _from, state) do
    tasks = Enum.map(state.tasks, fn
      %{id: ^id, status: :success} = t ->
        %{t | owner: owner, notification_status: "sent", logs: t.logs ++ ["[INFO] Notification sent to #{owner}"]}
      t -> t
    end)
    {:reply, :ok, %{state | tasks: tasks}}
  end

  @impl true
  def handle_call({:update_notification, id, status}, _from, state) do
    tasks = Enum.map(state.tasks, fn
      %{id: ^id} = t ->
        label = if status == "confirmed", do: "confirmed", else: "rejected"
        %{t | notification_status: status, logs: t.logs ++ ["[INFO] Business owner #{label} the result"]}
      t -> t
    end)
    {:reply, :ok, %{state | tasks: tasks}}
  end

  @impl true
  def handle_call(:get_stats, _from, state) do
    stats = %{
      total: length(state.tasks),
      running: Enum.count(state.tasks, & &1.status == :running),
      success: Enum.count(state.tasks, & &1.status == :success),
      failed: Enum.count(state.tasks, & &1.status == :failed)
    }
    {:reply, stats, state}
  end
end
