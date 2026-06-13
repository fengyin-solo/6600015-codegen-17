defmodule Scheduler.NotificationManager do
  use GenServer

  defmodule Notification do
    defstruct [
      :id, :task_id, :task_name, :owner, :status, :sent_at, :confirmed_at,
      :message, :priority, :deadline, :result_summary, :reject_reason,
      :confirm_remark, :external_contacts, :cc_list
    ]
  end

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def list_notifications(filters \\ %{}), do: GenServer.call(__MODULE__, {:list_notifications, filters})

  def get_notification(id), do: GenServer.call(__MODULE__, {:get_notification, id})

  def create_notification(params) do
    GenServer.call(__MODULE__, {:create_notification, params})
  end

  def confirm_notification(id, remark \\ nil), do: GenServer.call(__MODULE__, {:update_status, id, "confirmed", remark, nil})

  def reject_notification(id, reason \\ nil), do: GenServer.call(__MODULE__, {:update_status, id, "rejected", nil, reason})

  def get_stats, do: GenServer.call(__MODULE__, :get_stats)

  @impl true
  def init(_) do
    {:ok, %{notifications: seed_notifications(), counter: 50}}
  end

  defp seed_notifications do
    tasks = [
      %{id: "task-1001", name: "data_sync", owner: "zhangsan"},
      %{id: "task-1002", name: "email_batch", owner: "lisi"},
      %{id: "task-1003", name: "report_gen", owner: "wangwu"},
    ]
    statuses = ["sent", "confirmed", "rejected"]
    priorities = ["high", "medium", "low"]

    Enum.with_index(tasks, fn t, i ->
      status = Enum.at(statuses, i)
      %Notification{
        id: "notif-#{i + 1}",
        task_id: t.id,
        task_name: t.name,
        owner: t.owner,
        status: status,
        sent_at: DateTime.add(DateTime.utc_now(), -(i + 1) * 3600, :second),
        confirmed_at: if status != "sent", do: DateTime.add(DateTime.utc_now(), -(i) * 1800, :second), else: nil,
        message: "Task #{t.name} (#{t.id}) completed successfully, please confirm the result.",
        priority: Enum.at(priorities, i),
        deadline: if status == "sent", do: DateTime.add(DateTime.utc_now(), 24 * 3600, :second), else: nil,
        result_summary: "Processed #{1000 + i * 500} records, success rate #{95 + i * 2}%.",
        reject_reason: if status == "rejected", do: "Data mismatch found, please verify source data.", else: nil,
        confirm_remark: if status == "confirmed", do: "Result looks good, approved.", else: nil,
        external_contacts: ["external_#{i}@company.com"],
        cc_list: ["pm@company.com"]
      }
    end)
  end

  @impl true
  def handle_call({:list_notifications, filters}, _from, state) do
    result = Enum.filter(state.notifications, fn n ->
      cond do
        Map.get(filters, "status") && n.status != filters["status"] -> false
        Map.get(filters, "owner") && n.owner != filters["owner"] -> false
        Map.get(filters, "priority") && n.priority != filters["priority"] -> false
        true -> true
      end
    end)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:get_notification, id}, _from, state) do
    result = Enum.find(state.notifications, & &1.id == id)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:create_notification, params}, _from, state) do
    counter = state.counter + 1
    notification = %Notification{
      id: "notif-#{counter}",
      task_id: Map.fetch!(params, "task_id"),
      task_name: Map.fetch!(params, "task_name"),
      owner: Map.fetch!(params, "owner"),
      status: "sent",
      sent_at: DateTime.utc_now(),
      confirmed_at: nil,
      message: Map.get(params, "message") || "Task completed, please confirm the result.",
      priority: Map.get(params, "priority", "medium"),
      deadline: Map.get(params, "deadline"),
      result_summary: Map.get(params, "result_summary"),
      reject_reason: nil,
      confirm_remark: nil,
      external_contacts: Map.get(params, "external_contacts", []),
      cc_list: Map.get(params, "cc_list", [])
    }
    {:reply, notification, %{state | notifications: [notification | state.notifications], counter: counter}}
  end

  @impl true
  def handle_call({:update_status, id, status, remark, reason}, _from, state) do
    notifications = Enum.map(state.notifications, fn
      %{id: ^id} = n ->
        n
        |> Map.put(:status, status)
        |> Map.put(:confirmed_at, DateTime.utc_now())
        |> Map.put(:confirm_remark, if(status == "confirmed", do: remark, else: n.confirm_remark))
        |> Map.put(:reject_reason, if(status == "rejected", do: reason, else: n.reject_reason))
      n -> n
    end)
    {:reply, :ok, %{state | notifications: notifications}}
  end

  @impl true
  def handle_call(:get_stats, _from, state) do
    stats = %{
      total: length(state.notifications),
      pending: Enum.count(state.notifications, & &1.status == "sent"),
      confirmed: Enum.count(state.notifications, & &1.status == "confirmed"),
      rejected: Enum.count(state.notifications, & &1.status == "rejected"),
      high_priority_pending: Enum.count(state.notifications, & &1.status == "sent" and &1.priority == "high")
    }
    {:reply, stats, state}
  end
end
