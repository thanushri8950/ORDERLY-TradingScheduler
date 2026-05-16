def fcfs(queue):
    if not queue:
        return []
    return sorted(queue, key=lambda x: x["arrival_time"])


def priority(queue):
    if not queue:
        return []
    return sorted(queue, key=lambda x: x["priority"], reverse=True)


def hybrid(queue):
    if not queue:
        return []
    return sorted(queue, key=lambda x: (-x["priority"], x["arrival_time"]))